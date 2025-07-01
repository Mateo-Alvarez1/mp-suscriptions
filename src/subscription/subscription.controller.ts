import { Controller, Get, Post, Body } from "@nestjs/common";
import { SubscriptionService } from "./subscription.service";
import MercadoPagoConfig, { PreApproval } from "mercadopago";
import { ConfigService } from "@nestjs/config";

@Controller("subscription")
export class SubscriptionController {
  private client: MercadoPagoConfig;
  private preApproval: PreApproval;

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly configService: ConfigService
  ) {
    this.client = new MercadoPagoConfig({
      accessToken: this.configService.get<string>("MP_ACCESS_TOKEN_TEST")!,
    });
    this.preApproval = new PreApproval(this.client);
  }

  @Get("plans")
  getPlans() {
    return [
      { id: "basic", name: "Básico", price: 1000 },
      { id: "premium", name: "Premium", price: 2000 },
    ];
  }

  @Post("create")
  async createSubscription(@Body() body: any) {
    const { email, planId, amount } = body;

    try {
      const subscription = await this.preApproval.create({
        body: {
          reason: `Suscripción ${planId}`,
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: amount,
            currency_id: "ARS",
          },
          payer_email: email,
          back_url: "https://eaf6-45-226-58-74.ngrok-free.app/success",
          status: "pending",
        },
      });

      return {
        id: subscription.id,
        paymentUrl: subscription.init_point,
        status: "created",
      };
    } catch (error) {
      console.error("Error:", error);
      return { error: "Error creando suscripción" };
    }
  }

  @Post("cancel/:id")
  async cancelSubscription(@Body() body: { id: string }) {
    try {
      const result = await this.preApproval.update({
        id: body.id,
        body: {
          status: "cancelled",
        },
      });

      return { status: "cancelled", id: result.id };
    } catch (error) {
      return { error: "Error cancelando suscripción" };
    }
  }

  @Get("/:id")
  async getSubscription(@Body() body: { id: string }) {
    try {
      const subscription = await this.preApproval.get({ id: body.id });
      return subscription;
    } catch (error) {
      return { error: "Suscripción no encontrada" };
    }
  }

  @Post("webhook")
  webhook(@Body() body: any) {
    console.log("Webhook recibido:", body);

    // Si es un pago de suscripción
    if (body.type === "payment") {
      console.log("Pago procesado:", body.data.id);
    }

    // Si es actualización de preapproval
    if (body.type === "preapproval") {
      console.log("Suscripción actualizada:", body.data.id);
    }

    return { status: "ok" };
  }
}
