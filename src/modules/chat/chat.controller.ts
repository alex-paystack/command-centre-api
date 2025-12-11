import { Controller, Get, Post, Delete, Body, Param, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ConversationResponseDto } from './dto/conversation-response.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { ChatRequestDto } from './dto/chat-request.dto';

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
    type: ConversationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid input' })
  async createConversation(@Body() dto: CreateConversationDto): Promise<ConversationResponseDto> {
    return this.chatService.saveConversation(dto);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a conversation by ID' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Conversation found',
    type: ConversationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getConversation(@Param('id') id: string): Promise<ConversationResponseDto> {
    return this.chatService.getConversationById(id);
  }

  @Get('conversations/user/:userId')
  @ApiOperation({ summary: 'Get all conversations for a user' })
  @ApiParam({ name: 'userId', description: 'User ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'List of conversations',
    type: [ConversationResponseDto],
  })
  async getConversationsByUserId(@Param('userId') userId: string): Promise<ConversationResponseDto[]> {
    return this.chatService.getConversationsByUserId(userId);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a conversation by ID' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', type: String })
  @ApiResponse({ status: 204, description: 'Conversation deleted successfully' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async deleteConversation(@Param('id') id: string): Promise<void> {
    return this.chatService.deleteConversationById(id);
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
        deleted: { type: 'number', description: 'Number of conversations deleted' },
      },
    },
  })
  async deleteAllConversationsByUserId(@Param('userId') userId: string): Promise<{ deleted: number }> {
    const deleted = await this.chatService.deleteAllConversationsByUserId(userId);
    return { deleted };
  }

  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new message in a conversation' })
  @ApiBody({ type: CreateMessageDto })
  @ApiResponse({
    status: 201,
    description: 'Message created successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid input' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async createMessage(@Body() dto: CreateMessageDto): Promise<MessageResponseDto> {
    return this.chatService.saveMessage(dto);
  }

  @Get('messages/:chatId')
  @ApiOperation({ summary: 'Get all messages in a conversation' })
  @ApiParam({ name: 'chatId', description: 'Conversation UUID', type: String })
  @ApiResponse({
    status: 200,
    description: 'List of messages',
    type: [MessageResponseDto],
  })
  async getMessagesByChatId(@Param('chatId') chatId: string): Promise<MessageResponseDto[]> {
    return this.chatService.getMessagesByChatId(chatId);
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
  async streamChat(@Body() dto: ChatRequestDto, @Res() res: Response): Promise<void> {
    const result = await this.chatService.handleStreamingChat(dto);

    const response = result.toUIMessageStreamResponse({
      sendReasoning: true,
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
