import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const cookieExtractor = (req: any): string | null => {
  let token: string | null = null;
  if (req && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req && req.headers && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (match) {
      token = decodeURIComponent(match[1]);
    }
  }
  return token;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const bearerExtractor = ExtractJwt.fromAuthHeaderAsBearerToken();
    super({
      jwtFromRequest: (req: any) => {
        return cookieExtractor(req) || bearerExtractor(req);
      },
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'cashflow_jwt_secret_fallback',
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or token invalid');
    }

    return { userId: user.id, email: user.email, name: user.name };
  }
}
