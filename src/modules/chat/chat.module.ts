import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { ConversationRepository } from './repositories/conversation.repository';
import { MessageRepository } from './repositories/message.repository';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { PaystackApiService } from '../../common/services/paystack-api.service';
import { PageContextService } from '../../common/services/page-context.service';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message]), ConfigModule, HttpModule],
  providers: [ConversationRepository, MessageRepository, PaystackApiService, PageContextService, ChatService],
  controllers: [ChatController],
  exports: [ChatService],
})
export class ChatModule {}
