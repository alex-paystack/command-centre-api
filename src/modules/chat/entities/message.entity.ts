import { Entity, ObjectIdColumn, Column, CreateDateColumn, Index, ManyToOne } from 'typeorm';
import { ObjectId } from 'mongodb';
import { Conversation } from './conversation.entity';
import { UIMessage } from 'ai';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

@Entity('messages')
export class Message {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  @Index({ unique: true })
  id: string; // UUID auto-generated on server

  @Column()
  @Index()
  conversationId: string; // UUID reference to conversation

  @Column({
    type: 'enum',
    enum: MessageRole,
  })
  role: MessageRole;

  @Column('json')
  parts: UIMessage['parts'];

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  conversation: Conversation;
}
