import { Module } from '@nestjs/common';
import { XeduService } from './xedu.service';
import { XeduNodesController } from './xedu-nodes.controller';
import { XeduEdgesController } from './xedu-edges.controller';

@Module({
  controllers: [XeduNodesController, XeduEdgesController],
  providers: [XeduService],
  exports: [XeduService],
})
export class XeduModule {}
