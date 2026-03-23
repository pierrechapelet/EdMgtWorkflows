import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { XeduModule } from './xedu/xedu.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { FormsModule } from './forms/forms.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    // Config — loads .env file, available globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting — 100 requests per 60 seconds per IP
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // BullMQ — async job queues (notifications, PDF, audit writes)
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: config.get<string>('REDIS_URL', 'redis://localhost:6379'),
      }),
    }),

    // Core modules
    DatabaseModule,
    AuthModule,
    UsersModule,

    // Phase 2: Org graph + permissions
    XeduModule,
    RolesModule,
    PermissionsModule,

    // Phase 3: Form builder
    FormsModule,

    // Phase 4: Workflow designer
    WorkflowsModule,

    // Phase 5: Campaigns + assignment resolution
    CampaignsModule,

    // Phase 6: Submissions (fill, drafts, offline sync, signature, file upload)
    SubmissionsModule,

    // Phase 7: Approval chain + BullMQ escalation
    ApprovalsModule,

    // Phase 8: In-app notifications + email (SES)
    NotificationsModule,

    // Phase 9: Dashboard analytics, geo map, CSV/XLSX/PDF export
    ReportsModule,
  ],
})
export class AppModule {}
