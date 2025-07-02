import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { UpdatePlanDto } from "./dto/update-plan.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { Plan } from "./entities/plan.entity";
import { Repository } from "typeorm";
import { validate as IsUUID } from "uuid";

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>
  ) {}

  async create(createPlanDto: CreatePlanDto) {
    try {
      const plan = this.planRepository.create(createPlanDto);
      await this.planRepository.save(plan);
      return plan;
    } catch (error) {
      this.handleErrors(error);
    }
  }

  findAll() {
    return this.planRepository.find();
  }

  async findOne(term: string) {
    let plan: Plan | null;

    if (IsUUID(term)) {
      plan = await this.planRepository.findOneBy({ id: term });
    } else {
      const queryBuilder = this.planRepository.createQueryBuilder();
      plan = await queryBuilder
        .where(`status =:status`, {
          status: term,
        })
        .getOne();
    }

    if (!plan) {
      throw new NotFoundException(`Plan with ${term} not found`);
    }

    return plan;
  }

  async update(id: string, updatePlanDto: UpdatePlanDto) {
    try {
      const plan = await this.planRepository.preload({
        id: id,
        ...updatePlanDto,
      });

      if (!plan) {
        throw new BadRequestException(
          `Plan Whit id ${id} not found in database`
        );
      }

      await this.planRepository.save(plan);
      return plan;
    } catch (error) {
      console.log(error);
    }
  }

  async remove(id: string) {
    const { affected } = await this.planRepository.delete({ id });
    if (affected === 0)
      throw new BadRequestException(
        `Not found plan whit ${id} in the database`
      );

    return;
  }

  private handleErrors(error: any) {
    if (error.code === "23505") throw new BadRequestException(error.detail);
    throw new InternalServerErrorException("Unexpected problem , check logs");
  }
}
