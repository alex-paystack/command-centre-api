import { Entity, ObjectIdColumn, Column, CreateDateColumn, Index, ManyToOne, BeforeInsert } from 'typeorm';
import { ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';
import { Conversation } from './conversation.entity';
import { UIMessage } from 'ai';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
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
  chatId: string; // UUID reference to conversation

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

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }
}
