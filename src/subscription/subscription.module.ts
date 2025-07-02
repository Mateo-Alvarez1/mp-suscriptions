import { Module } from "@nestjs/common";
import { SubscriptionService } from "./subscription.service";
import { SubscriptionController } from "./subscription.controller";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Subscription } from "./entities/subscription.entity";
import { PlansModule } from "src/plans/plans.module";
import { AuthModule } from "src/auth/auth.module";

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Subscription]),
    PlansModule,
    AuthModule,
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
})
export class SubscriptionModule {}
