import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { CategorizationRulesService } from './categorization-rules.service';
import { CreateRuleDto, UpdateRuleDto } from './dto/rule.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, UserPayload } from '../common/current-user.decorator';

@Controller('categorization-rules')
@UseGuards(JwtAuthGuard)
export class CategorizationRulesController {
  constructor(private readonly rulesService: CategorizationRulesService) {}

  @Get()
  async findAll(@CurrentUser() user: UserPayload) {
    return this.rulesService.findAll(user.userId);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.rulesService.findOne(user.userId, id);
  }

  @Post()
  async create(@CurrentUser() user: UserPayload, @Body() dto: CreateRuleDto) {
    return this.rulesService.create(user.userId, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateRuleDto,
  ) {
    return this.rulesService.update(user.userId, id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.rulesService.remove(user.userId, id);
  }
}
