import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { TrackEventDto } from './dto/track-event.dto';
import { UserEventsService } from './user-events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly events: UserEventsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  track(@Body() dto: TrackEventDto) {
    return this.events.trackEvent(dto);
  }
}
