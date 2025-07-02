import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { CreateUserDto } from "./dto/create-user.dto";
import * as bcrypt from "bcrypt";
import { LoginUserDto } from "./dto/login-user.dto";
import { JwtPayload } from "src/interfaces/jwt.interfaces";
import { User } from "./entities/user.entity";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService
  ) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const { password, ...userData } = createUserDto;

      const user = this.userRepository.create({
        ...userData,
        password: bcrypt.hashSync(password, 10),
      });

      await this.userRepository.save(user);

      return {
        ...user,
        token: this.jwtToken({ id: user.id }),
      };
    } catch (error) {
      this.handleErrors(error);
    }
  }

  async login(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;

    const user = await this.userRepository.findOne({
      where: { email },
      select: { email: true, password: true, id: true },
    });

    if (!user) {
      throw new BadRequestException("Credentials are not valid (email)");
    }

    if (!bcrypt.compareSync(password, user.password)) {
      throw new BadRequestException("Credentials are not valid (password)");
    }

    return {
      ...user,
      token: this.jwtToken({ id: user.id }),
    };
  }

  private jwtToken(payload: JwtPayload) {
    const token = this.jwtService.sign(payload);
    return token;
  }

  private handleErrors(error: any) {
    if (error.code === "23505") {
      throw new BadRequestException(error.detail);
    }
    throw new InternalServerErrorException("Unexpected error check the logs");
  }
}
