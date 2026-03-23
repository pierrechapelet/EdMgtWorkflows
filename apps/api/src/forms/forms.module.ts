import { Module } from '@nestjs/common';
import { FormsService } from './forms.service';
import { FormsTemplatesController } from './forms-templates.controller';
import { FormsVersionsController } from './forms-versions.controller';
import { FormsComponentsController } from './forms-components.controller';

@Module({
  controllers: [FormsTemplatesController, FormsVersionsController, FormsComponentsController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}
