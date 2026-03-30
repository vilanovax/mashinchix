import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateWatchlistDto } from './dto/create-watchlist.dto';
import { UpdateWatchlistDto } from './dto/update-watchlist.dto';
import { WatchlistService } from './watchlist.service';

@Controller('watchlist')
export class WatchlistController {
  constructor(private readonly watchlist: WatchlistService) {}

  @Post()
  create(@Body() dto: CreateWatchlistDto) {
    return this.watchlist.create(dto);
  }

  @Get(':userId')
  listForUser(@Param('userId') userId: string) {
    return this.watchlist.listForUser(userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWatchlistDto) {
    return this.watchlist.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.watchlist.remove(id);
  }
}
