import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import MercadoPagoConfig, { PreApproval } from "mercadopago";
import {
  Subscription,
  SubscriptionStatus,
} from "./entities/subscription.entity";
import { Repository } from "typeorm";
import { PlansService } from "src/plans/plans.service";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { User } from "src/auth/entities/user.entity";

@Injectable()
export class SubscriptionService {
  private client: MercadoPagoConfig;
  private preApproval: PreApproval;

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    private readonly planService: PlansService,
    private readonly configService: ConfigService
  ) {
    this.client = new MercadoPagoConfig({
      accessToken: this.configService.get<string>("MP_ACCESS_TOKEN_TEST")!,
    });
    this.preApproval = new PreApproval(this.client);
  }

  async createSubscription(
    createSubscriptionDto: CreateSubscriptionDto,
    user: User
  ) {
    const { email, planId, amount } = createSubscriptionDto;

    try {
      const existingSubscription = await this.subscriptionRepository.findOne({
        where: {
          user: { id: user.id },
        },
        relations: ["user", "plan"],
      });

      const plan = await this.planService.findOne(planId);
      if (!plan || plan.status !== "active")
        throw new NotFoundException("Plan no encontrado o inactivo");

      if (Number(plan.price) !== Number(amount)) {
        throw new BadRequestException(
          "El monto no coincide con el precio del plan"
        );
      }
      console.log(
        " SubscriptionService - existingSubscription",
        existingSubscription
      );

      if (
        existingSubscription &&
        existingSubscription?.plan.id === planId &&
        existingSubscription.status !== SubscriptionStatus.CANCELLED
      ) {
        throw new BadRequestException(
          "El usuario ya tiene una suscripción activa para este plan"
        );
      }

      if (
        existingSubscription &&
        existingSubscription.plan.id !== planId &&
        existingSubscription.status !== SubscriptionStatus.CANCELLED
      ) {
        await this.cancelCurrentSubscriptionForUpgrade(existingSubscription!);
      }

      const mpSubscription = await this.preApproval.create({
        body: {
          reason: `Suscripción ${plan.name}`,
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: amount,
            currency_id: "ARS",
          },
          payer_email: email,
          back_url: "https://e761-45-226-58-78.ngrok-free.app/success",
          status: "pending",
        },
      });

      const subscription = this.subscriptionRepository.create({
        mercadopagoId: mpSubscription.id,
        user,
        plan,
        status: SubscriptionStatus.PENDING,
        amount,
        currencyId: "ARS",
        frequencyType: "months",
        frequency: 1,
        paymentUrl: mpSubscription.init_point,
        backUrl: mpSubscription.back_url,
        externalReference: `subscription_${user.id}_${Date.now()}`,
      });

      const savedSubscription =
        await this.subscriptionRepository.save(subscription);
      return {
        id: savedSubscription.id,
        mercadopagoId: mpSubscription.id,
        paymentUrl: mpSubscription.init_point,
        status: "created",
        subscription: savedSubscription,
      };
    } catch (error) {
      console.error("Error:", error);
      return { error: "Error creando suscripción" };
    }
  }

  async cancelSubscription(id: string) {
    try {
      const subscription = await this.subscriptionRepository.findOne({
        where: { id },
        relations: ["user", "plan"],
      });

      if (!subscription) {
        throw new NotFoundException("Suscripción no encontrada");
      }

      const result = await this.preApproval.update({
        id: subscription.mercadopagoId,
        body: {
          status: "cancelled",
        },
      });

      subscription.status = SubscriptionStatus.CANCELLED;
      await this.subscriptionRepository.save(subscription);

      return {
        status: "cancelled",
        id: result.id,
        subscription: subscription,
      };
    } catch (error) {
      return { error: "Error cancelando suscripción" };
    }
  }

  async getSubscription(id: string) {
    try {
      const localSubscription = await this.subscriptionRepository.findOne({
        where: { id },
        relations: ["user", "plan"],
      });

      if (!localSubscription) {
        throw new NotFoundException("Suscripción no encontrada");
      }

      const mpSubscription = await this.preApproval.get({
        id: localSubscription.mercadopagoId,
      });

      return {
        ...localSubscription,
        mercadopagoStatus: mpSubscription.status,
        mercadopagoData: mpSubscription,
      };
    } catch (error) {
      throw new InternalServerErrorException("Error obteniendo suscripción");
    }
  }

  // WEBHOOKS HANDLERS

  async proccessPaymentWebhook(paymentData: any) {
    try {
      const { external_reference, status } = paymentData;

      if (!external_reference) {
        throw new BadRequestException("No external_reference found in payment");
      }

      const subscription = await this.subscriptionRepository.findOne({
        where: {
          externalReference: external_reference,
        },
        relations: ["user", "plan"],
      });

      if (!subscription)
        throw new NotFoundException(
          `Suscripción no encontrada para external_reference: ${external_reference}`
        );

      switch (status) {
        case "approved":
          await this.handleApprovedPayment(subscription, paymentData);
          break;
        case "rejected":
          await this.handleRejectedPayment(subscription, paymentData);
          break;
        case "pending":
          await this.handlePendingPayment(subscription, paymentData);
          break;
        case "cancelled":
          await this.handleCancelledPayment(subscription, paymentData);
          break;
      }
    } catch (error) {
      console.error("Error procesando webhook de pago:", error);
      throw error;
    }
  }

  async handleApprovedPayment(subscription: Subscription, paymentData: any) {
    try {
      subscription.status = SubscriptionStatus.AUTHORIZED;
      subscription.lastPaymentDate = new Date(paymentData.date_approved);
      subscription.nextPaymentDate = this.calculateNextPaymentDate(
        subscription.frequencyType,
        subscription.frequency
      );
      subscription.paymentStatus = "paid";
      subscription.failedPaymentCount = 0;

      await this.subscriptionRepository.save(subscription);
    } catch (error) {
      console.error("Error manejando pago aprobado:", error);
      throw error;
    }
  }

  async handleRejectedPayment(subscription: Subscription, paymentData: any) {
    try {
      subscription.paymentStatus = "failed";
      subscription.failedPaymentCount =
        (subscription.failedPaymentCount || 0) + 1;

      if (subscription.failedPaymentCount >= 3) {
        subscription.status = SubscriptionStatus.SUSPENDED;
        subscription.suspendedAt = new Date();
      }

      await this.subscriptionRepository.save(subscription);

      console.log(`Pago rechazado para suscripción: ${subscription.id}`);
    } catch (error) {
      console.error("Error manejando pago rechazado:", error);
      throw error;
    }
  }

  async handlePendingPayment(subscription: Subscription, paymentData: any) {
    try {
      subscription.paymentStatus = "pending";
      await this.subscriptionRepository.save(subscription);

      console.log(`Pago pendiente para suscripción: ${subscription.id}`);
    } catch (error) {
      console.error("Error manejando pago pendiente:", error);
      throw error;
    }
  }

  async handleCancelledPayment(subscription: Subscription, paymentData: any) {
    try {
      subscription.status = SubscriptionStatus.CANCELLED;
      subscription.cancelledAt = new Date();
      await this.subscriptionRepository.save(subscription);

      console.log(`Pago cancelado para suscripción: ${subscription.id}`);
    } catch (error) {
      console.error("Error manejando pago cancelado:", error);
      throw error;
    }
  }

  // PRIVATE METHODS
  private async cancelCurrentSubscriptionForUpgrade(
    subscription: Subscription
  ) {
    try {
      await this.preApproval.update({
        id: subscription.mercadopagoId,
        body: {
          status: "cancelled",
        },
      });

      subscription.status = SubscriptionStatus.CANCELLED;
      subscription.cancelReason = "upgrade";
      await this.subscriptionRepository.save(subscription);

      console.log(`Suscripción ${subscription.id} cancelada para upgrade`);
    } catch (error) {
      console.error("Error cancelando suscripción para upgrade:", error);
      throw new InternalServerErrorException("Error procesando cambio de plan");
    }
  }

  private calculateNextPaymentDate(
    frequencyType: string,
    frequency: number
  ): Date {
    const now = new Date();

    switch (frequencyType) {
      case "months":
        return new Date(now.setMonth(now.getMonth() + frequency));
      case "days":
        return new Date(now.setDate(now.getDate() + frequency));
      case "years":
        return new Date(now.setFullYear(now.getFullYear() + frequency));
      default:
        return new Date(now.setMonth(now.getMonth() + 1));
    }
  }
}
