import { Controller, Get, Delete, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AdminFilesService } from './admin-files.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('admin/files')
@UseGuards(JwtAuthGuard)
export class AdminFilesController {
  constructor(private adminFilesService: AdminFilesService) {}

  @Get()
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const p = parseInt(page, 10) || 1;
    const l = parseInt(limit, 10) || 20;
    return this.adminFilesService.findAll(p, l);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminFilesService.remove(id);
  }
}
