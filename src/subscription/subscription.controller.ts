import { Controller, Get, Post, Body, Param } from "@nestjs/common";
import { SubscriptionService } from "./subscription.service";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { GetUser } from "src/auth/decorators/get-user.decorator";
import { User } from "src/auth/entities/user.entity";
import { Auth } from "src/auth/decorators/auth.decorator";
import { ValidRoles } from "src/interfaces/valid-roles.interfaces";

@Controller("subscription")

// COMO CAMBIAR EL ESTADO DEL PAGO YA SE CUANDO YA PAGO , CUANDO CANCELO , ETC
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post("create")
  @Auth(ValidRoles.user)
  async createSubscription(
    @Body() createSubscriptionDto: CreateSubscriptionDto,
    @GetUser() user: User
  ) {
    return this.subscriptionService.createSubscription(
      createSubscriptionDto,
      user
    );
  }

  @Post("cancel/:id")
  async cancelSubscription(@Param("id") id: string) {
    return this.subscriptionService.cancelSubscription(id);
  }

  @Get("/:id")
  async getSubscription(@Param("id") id: string) {
    return this.subscriptionService.getSubscription(id);
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
