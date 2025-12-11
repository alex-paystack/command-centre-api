import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ConversationResponseDto } from './dto/conversation-response.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { MessageRole } from './entities/message.entity';
import { PaystackResponse } from '../../common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiBody({ type: CreateConversationDto })
  @ApiResponse({ status: 201, description: 'Conversation created successfully', type: ConversationResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request - invalid input' })
  async createConversation(@Body() dto: CreateConversationDto, @CurrentUser() userId: string) {
    const conversationDto = { ...dto, userId };
    const conversation = await this.chatService.saveConversation(conversationDto);
    return PaystackResponse.success(conversation, 'Conversation created successfully');
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get all conversations for the authenticated user' })
  @ApiResponse({ status: 200, description: 'List of conversations', type: [ConversationResponseDto] })
  async getConversationsByUserId(@CurrentUser() userId: string) {
    const conversations = await this.chatService.getConversationsByUserId(userId);
    return PaystackResponse.success(conversations, 'Conversations retrieved successfully');
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a conversation by ID' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', type: String })
  @ApiResponse({ status: 200, description: 'Conversation found', type: ConversationResponseDto })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getConversation(@Param('id') id: string, @CurrentUser() userId: string) {
    const conversation = await this.chatService.getConversationById(id, userId);
    return PaystackResponse.success(conversation, 'Conversation retrieved successfully');
  }

  @Delete('conversations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete all conversations for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Conversations deleted successfully' })
  async deleteAllConversationsByUserId(@CurrentUser() userId: string) {
    const deleted = await this.chatService.deleteAllConversationsByUserId(userId);
    return PaystackResponse.success({ deleted }, 'Conversations deleted successfully');
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a conversation by ID' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', type: String })
  @ApiResponse({ status: 200, description: 'Conversation deleted successfully' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async deleteConversation(@Param('id') id: string, @CurrentUser() userId: string) {
    await this.chatService.deleteConversationById(id, userId);
    return PaystackResponse.success(null, 'Conversation deleted successfully');
  }

  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create messages in a conversation' })
  @ApiBody({ type: [CreateMessageDto] })
  @ApiResponse({ status: 201, description: 'Messages created successfully', type: [MessageResponseDto] })
  @ApiResponse({ status: 400, description: 'Bad request - invalid input' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async createMessages(@Body() dtos: CreateMessageDto[], @CurrentUser() userId: string) {
    const messages = await this.chatService.saveMessages(dtos, userId);
    return PaystackResponse.success(messages, 'Messages created successfully');
  }

  @Get('messages/:conversationId')
  @ApiOperation({ summary: 'Get all messages in a conversation' })
  @ApiParam({ name: 'conversationId', description: 'Conversation UUID', type: String })
  @ApiResponse({ status: 200, description: 'List of messages', type: [MessageResponseDto] })
  async getMessagesByConversationId(@Param('conversationId') conversationId: string, @CurrentUser() userId: string) {
    const messages = await this.chatService.getMessagesByConversationId(conversationId, userId);
    return PaystackResponse.success(messages, 'Messages retrieved successfully');
  }

  @Post('stream')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stream AI chat response' })
  @ApiBody({ type: ChatRequestDto })
  @ApiResponse({ status: 200, description: 'Streaming AI response' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid input' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded - user has sent too many messages in the current period',
  })
  async streamChat(
    @Body() dto: ChatRequestDto,
    @CurrentUser() userId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization header missing or malformed');
    }

    const jwtToken = authHeader.split(' ')[1];

    const result = await this.chatService.handleStreamingChat(dto, userId, jwtToken);

    const response = result.toUIMessageStreamResponse({
      sendReasoning: true,
      onFinish: async ({ messages }) => {
        const formattedMessages = messages.map((message) => ({
          conversationId: dto.conversationId,
          role: message.role as MessageRole,
          parts: message.parts,
        }));

        await this.chatService.saveMessages(formattedMessages, userId);
      },
    });

    res.status(response.status ?? HttpStatus.OK);

    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const { body } = response;
    if (!body) {
      return res.end();
    }

    const reader = body.getReader();
    let aborted = false;

    req.on('close', () => {
      aborted = true;
      reader.cancel().catch(() => undefined);
    });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done || aborted) {
          break;
        }
        res.write(value);
      }
      if (!res.writableEnded) {
        res.end();
      }
    } catch {
      if (!res.writableEnded) {
        res.status(500).end();
      }
    }
  }
}
