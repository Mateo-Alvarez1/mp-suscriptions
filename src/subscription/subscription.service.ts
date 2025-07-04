import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import MercadoPagoConfig, { Payment, PreApproval } from "mercadopago";
import {
  Subscription,
  SubscriptionStatus,
} from "./entities/subscription.entity";
import { Repository } from "typeorm";
import { PlansService } from "src/plans/plans.service";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { User } from "src/auth/entities/user.entity";
import { Plan } from "src/plans/entities/plan.entity";

@Injectable()
export class SubscriptionService {
  private client: MercadoPagoConfig;
  private preApproval: PreApproval;

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    // @InjectRepository(User)
    // private userRepository: Repository<User>,
    // @InjectRepository(Plan)
    // private planRepository: Repository<Plan>,
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
      const plan = await this.planService.findOne(planId);
      if (!plan || plan.status !== "active")
        throw new NotFoundException("Plan no encontrado o inactivo");

      if (Number(plan.price) !== Number(amount)) {
        throw new BadRequestException(
          "El monto no coincide con el precio del plan"
        );
      }

      const externalReference = `subscription_${user.id}_${Date.now()}`;

      const mpSubscription = await this.preApproval.create({
        body: {
          payer_email: email,
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: amount,
            currency_id: "ARS",
          },
          reason: `${plan.name}`,
          back_url: "https://2a4a-45-226-58-64.ngrok-free.app/succes",
          external_reference: externalReference,
          status: "pending",
        },
      });

      return {
        paymentUrl: mpSubscription.init_point,
        externalReference,
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
      console.log(
        " SubscriptionService - getSubscription - localSubscription",
        localSubscription
      );

      if (!localSubscription || localSubscription === null) {
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

  // TODO -> WEBHOOKS HANDLERS
}
