import { Controller, Get, Query } from '@nestjs/common';
import { ComparisonService } from './comparison.service';

@Controller()
export class ComparisonsController {
  constructor(private readonly comparison: ComparisonService) {}

  @Get('compare')
  compare(@Query('a') a: string, @Query('b') b: string) {
    return this.comparison.compare(a, b);
  }
}
