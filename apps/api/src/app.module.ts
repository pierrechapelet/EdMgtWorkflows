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

    // Phase 4+: WorkflowsModule
    // Phase 5+: CampaignsModule, AssignmentsModule
    // Phase 6+: SubmissionsModule
    // Phase 7+: ApprovalsModule
    // Phase 8+: NotificationsModule
    // Phase 9+: GeoModule, ReportsModule
  ],
})
export class AppModule {}
