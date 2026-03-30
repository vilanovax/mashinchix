import { Body, Controller, Post } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { CreateRecommendationDto } from './dto/create-recommendation.dto';
import { RecommendV2Dto } from './dto/recommend-v2.dto';
import { RecommendV3Dto } from './dto/recommend-v3.dto';

@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationService) {}

  @Post('v3')
  createV3(@Body() dto: RecommendV3Dto) {
    return this.recommendations.recommendV3(dto);
  }

  @Post('v2')
  createV2(@Body() dto: RecommendV2Dto) {
    return this.recommendations.recommendV2(dto);
  }

  @Post()
  create(@Body() dto: CreateRecommendationDto) {
    return this.recommendations.recommend(dto);
  }
}
