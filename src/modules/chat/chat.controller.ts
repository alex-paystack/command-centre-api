import { Controller, Get, Post, Delete, Body, Param, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChatRequestDto } from './dto/chat-request.dto';
import { MessageRole } from './entities/message.entity';
import { PaystackResponse } from '../../common';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiBody({ type: CreateConversationDto })
  @ApiResponse({
    status: 201,
    description: 'Conversation created successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Conversation created successfully' },
        data: { $ref: '#/components/schemas/ConversationResponseDto' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid input' })
  async createConversation(@Body() dto: CreateConversationDto) {
    const conversation = await this.chatService.saveConversation(dto);
    return PaystackResponse.success(conversation, 'Conversation created successfully');
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a conversation by ID' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Conversation found',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Conversation retrieved successfully' },
        data: { $ref: '#/components/schemas/ConversationResponseDto' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getConversation(@Param('id') id: string) {
    const conversation = await this.chatService.getConversationById(id);
    return PaystackResponse.success(conversation, 'Conversation retrieved successfully');
  }

  @Get('conversations/user/:userId')
  @ApiOperation({ summary: 'Get all conversations for a user' })
  @ApiParam({ name: 'userId', description: 'User ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'List of conversations',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Conversations retrieved successfully' },
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/ConversationResponseDto' },
        },
      },
    },
  })
  async getConversationsByUserId(@Param('userId') userId: string) {
    const conversations = await this.chatService.getConversationsByUserId(userId);
    return PaystackResponse.success(conversations, 'Conversations retrieved successfully');
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a conversation by ID' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Conversation deleted successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Conversation deleted successfully' },
        data: { type: 'object', nullable: true, example: null },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async deleteConversation(@Param('id') id: string) {
    await this.chatService.deleteConversationById(id);
    return PaystackResponse.success(null, 'Conversation deleted successfully');
  }

  @Delete('conversations/user/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete all conversations for a user' })
  @ApiParam({ name: 'userId', description: 'User ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Conversations deleted successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Conversations deleted successfully' },
        data: {
          type: 'object',
          properties: {
            deleted: { type: 'number', description: 'Number of conversations deleted' },
          },
        },
      },
    },
  })
  async deleteAllConversationsByUserId(@Param('userId') userId: string) {
    const deleted = await this.chatService.deleteAllConversationsByUserId(userId);
    return PaystackResponse.success({ deleted }, 'Conversations deleted successfully');
  }

  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create messages in a conversation' })
  @ApiBody({ type: [CreateMessageDto] })
  @ApiResponse({
    status: 201,
    description: 'Messages created successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Messages created successfully' },
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/MessageResponseDto' },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid input' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async createMessages(@Body() dtos: CreateMessageDto[]) {
    const messages = await this.chatService.saveMessages(dtos);
    return PaystackResponse.success(messages, 'Messages created successfully');
  }

  @Get('messages/:conversationId')
  @ApiOperation({ summary: 'Get all messages in a conversation' })
  @ApiParam({ name: 'conversationId', description: 'Conversation UUID', type: String })
  @ApiResponse({
    status: 200,
    description: 'List of messages',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Messages retrieved successfully' },
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/MessageResponseDto' },
        },
      },
    },
  })
  async getMessagesByConversationId(@Param('conversationId') conversationId: string) {
    const messages = await this.chatService.getMessagesByConversationId(conversationId);
    return PaystackResponse.success(messages, 'Messages retrieved successfully');
  }

  @Post('stream')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stream AI chat response' })
  @ApiBody({ type: ChatRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Streaming AI response',
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid input' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded - user has sent too many messages in the current period',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'boolean', example: false },
        type: { type: 'string', example: 'api_error' },
        code: { type: 'string', example: 'rate_limited' },
        message: {
          type: 'string',
          example:
            'Rate limit exceeded. You have sent 100 messages in the last 24 hour(s). The limit is 100 messages per 24 hour(s).',
        },
        data: {
          type: 'object',
          properties: {
            limit: { type: 'number', example: 100 },
            periodHours: { type: 'number', example: 24 },
            currentCount: { type: 'number', example: 100 },
          },
        },
      },
    },
  })
  async streamChat(@Body() dto: ChatRequestDto, @Res() res: Response) {
    const result = await this.chatService.handleStreamingChat(dto);

    const response = result.toUIMessageStreamResponse({
      sendReasoning: true,
      onFinish: async ({ messages }) => {
        const formattedMessages = messages.map((message) => ({
          conversationId: dto.conversationId,
          role: message.role as MessageRole,
          parts: message.parts,
        }));

        await this.chatService.saveMessages(formattedMessages);
      },
    });

    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          res.write(value);
        }
        res.end();
      } catch {
        res.status(500).end();
      }
    } else {
      res.end();
    }
  }
}
