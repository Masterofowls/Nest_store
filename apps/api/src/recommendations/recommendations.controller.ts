import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation/zod-validation.pipe';
import { recommendationQuerySchema } from './recommendation.schema';
import type { RecommendationQuery } from './recommendation.schema';
import { RecommendationsService } from './recommendations.service';

@Controller('products/:productId/recommendations')
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  @Get()
  findForProduct(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Query(new ZodValidationPipe(recommendationQuerySchema))
    query: RecommendationQuery,
  ) {
    return this.recommendations.findForProduct(productId, query);
  }
}
