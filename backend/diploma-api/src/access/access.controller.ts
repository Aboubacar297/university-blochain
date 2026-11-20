import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser, Role } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AccessService } from './access.service';
import { RequestAccessDto } from './dto/request-access.dto';

@ApiTags('access')
@Controller('access')
export class AccessController {
  constructor(private readonly access: AccessService) {}

  /** Public : 5 demandes par minute et par adresse IP au maximum. */
  @Post('request')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  request(@Body() dto: RequestAccessDto, @Req() req: Request) {
    return this.access.request(dto, req.ip);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.Student)
  me(@CurrentUser() user: AuthUser) {
    return this.access.me(user);
  }
}
