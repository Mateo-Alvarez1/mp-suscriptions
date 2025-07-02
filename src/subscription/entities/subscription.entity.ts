import { User } from "src/auth/entities/user.entity";
import { Plan } from "src/plans/entities/plan.entity";
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

export enum SubscriptionStatus {
  PENDING = "pending",
  AUTHORIZED = "authorized",
  PAUSED = "paused",
  SUSPENDED = "suspended",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

@Entity()
export class Subscription {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "mercadopago_id", unique: true })
  mercadopagoId: string;

  @Column({
    type: "enum",
    enum: SubscriptionStatus,
    default: SubscriptionStatus.PENDING,
  })
  status: SubscriptionStatus;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  amount: number;

  @Column({ default: "ARS" })
  currencyId: string;

  @Column({ default: "months" })
  frequencyType: string;

  @Column({ type: "int", default: 1 })
  frequency: number;

  @Column({ nullable: true })
  paymentUrl: string;

  @Column({ nullable: true })
  backUrl: string;

  @Column({ nullable: true })
  cancelReason: string;

  @Column({ nullable: true })
  externalReference: string;

  @Column({ nullable: true })
  cancelledAt: Date;

  @Column({ nullable: true })
  lastPaymentDate: Date;

  @Column({ nullable: true })
  suspendedAt: Date;

  @Column({ nullable: true })
  nextPaymentDate: Date;

  @Column({ nullable: true })
  paymentStatus: string; // 'pending', 'paid', 'failed'

  @Column({ default: 0 })
  failedPaymentCount: number;

  @ManyToOne(() => User, (user) => user.subscription, { cascade: true })
  @JoinColumn()
  user: User;

  @ManyToOne(() => Plan, (plan) => plan.subscription, { cascade: true })
  @JoinColumn()
  plan: Plan;
}
