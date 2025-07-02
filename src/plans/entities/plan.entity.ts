import { Subscription } from "src/subscription/entities/subscription.entity";
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";

export enum PlanStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  PAUSED = "paused",
}

@Entity()
export class Plan {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("text", {
    unique: true,
  })
  name: string;

  @Column("text")
  description: string;

  @Column()
  price: number;

  @Column({
    type: "enum",
    enum: PlanStatus,
    default: PlanStatus.ACTIVE,
  })
  status: PlanStatus;

  @OneToMany(() => Subscription, (subscription) => subscription.plan)
  subscription: Subscription;
}
