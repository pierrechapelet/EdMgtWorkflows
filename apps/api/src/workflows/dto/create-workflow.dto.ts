import { IsObject, IsUUID, IsNotEmpty } from 'class-validator';

export class CreateWorkflowDto {
  @IsObject()
  name: Record<string, string>;

  @IsUUID()
  ownerNodeId: string;
}
