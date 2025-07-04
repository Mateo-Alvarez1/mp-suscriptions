import { Controller, Get, Post, Body, Param } from "@nestjs/common";
import { SubscriptionService } from "./subscription.service";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { GetUser } from "src/auth/decorators/get-user.decorator";
import { User } from "src/auth/entities/user.entity";
import { Auth } from "src/auth/decorators/auth.decorator";
import { ValidRoles } from "src/interfaces/valid-roles.interfaces";

@Controller("subscription")
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

  // TODO -> WEBHOOKS HANDLERS
}
