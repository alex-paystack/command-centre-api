import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { ConversationRepository } from './repositories/conversation.repository';
import { MessageRepository } from './repositories/message.repository';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { PageContextService } from '~/common/services/page-context.service';
import { PaystackModule } from '~/common/services/paystack.module';
import { LangfuseModule } from '~/common/observability/langfuse.module';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message]), ConfigModule, PaystackModule, LangfuseModule],
  providers: [ConversationRepository, MessageRepository, PageContextService, ChatService],
  controllers: [ChatController],
  exports: [ChatService],
})
export class ChatModule {}
