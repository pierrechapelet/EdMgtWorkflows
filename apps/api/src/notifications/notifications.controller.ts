import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationQueryDto } from './dto/notification-query.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** GET /notifications — paginated list for authenticated user */
  @Get()
  async getNotifications(
    @Request() req: { user: { sub: string } },
    @Query() query: NotificationQueryDto,
  ) {
    return this.notificationsService.getForUser(req.user.sub, query);
  }

  /** GET /notifications/unread-count */
  @Get('unread-count')
  async getUnreadCount(@Request() req: { user: { sub: string } }) {
    return this.notificationsService.getUnreadCount(req.user.sub);
  }

  /** PATCH /notifications/read-all */
  @Patch('read-all')
  async markAllRead(@Request() req: { user: { sub: string } }) {
    return this.notificationsService.markAllRead(req.user.sub);
  }

  /** PATCH /notifications/:id/read */
  @Patch(':id/read')
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { sub: string } },
  ) {
    return { data: await this.notificationsService.markRead(req.user.sub, id) };
  }
}
