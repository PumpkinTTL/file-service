import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AdminTokensService } from './admin-tokens.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateTokenDto, UpdateTokenDto } from './dto/token.dto';

@Controller('admin/tokens')
@UseGuards(JwtAuthGuard)
export class AdminTokensController {
  constructor(private adminTokensService: AdminTokensService) {}

  @Post()
  async create(@Body() dto: CreateTokenDto) {
    return this.adminTokensService.create(dto);
  }

  @Get()
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const p = parseInt(page, 10) || 1;
    const l = parseInt(limit, 10) || 20;
    return this.adminTokensService.findAll(p, l);
  }

  @Patch(':id/disable')
  async disable(@Param('id', ParseIntPipe) id: number) {
    return this.adminTokensService.setEnabled(id, false);
  }

  @Patch(':id/enable')
  async enable(@Param('id', ParseIntPipe) id: number) {
    return this.adminTokensService.setEnabled(id, true);
  }

  @Patch(':id/rotate')
  async rotate(@Param('id', ParseIntPipe) id: number) {
    return this.adminTokensService.rotate(id);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminTokensService.remove(id);
  }
}
