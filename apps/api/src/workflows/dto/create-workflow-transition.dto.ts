import { IsUUID, IsEnum, IsOptional, IsObject } from 'class-validator';
import { TriggerAction } from '@edmgt/shared-types';

export class CreateWorkflowTransitionDto {
  @IsUUID()
  fromStepId: string;

  @IsUUID()
  toStepId: string;

  @IsEnum(TriggerAction)
  triggerAction: TriggerAction;

  /** Optional CEL-style conditions evaluated at transition time */
  @IsObject()
  @IsOptional()
  conditions?: Record<string, unknown>;
}
