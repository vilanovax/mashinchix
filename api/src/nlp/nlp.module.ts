import { Module } from '@nestjs/common';
import { NlpPipelineService } from './nlp-pipeline.service';

@Module({
  providers: [NlpPipelineService],
  exports: [NlpPipelineService],
})
export class NlpModule {}
