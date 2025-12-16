import { Injectable } from '@nestjs/common';
import { DataSource, MongoRepository } from 'typeorm';
import { Message } from '../entities/message.entity';
import { MessageRole } from '../entities/message.entity';

@Injectable()
export class MessageRepository extends MongoRepository<Message> {
  constructor(private dataSource: DataSource) {
    super(Message, dataSource.createEntityManager());
  }

  async findByConversationId(conversationId: string) {
    return this.findBy({ conversationId });
  }

  async createMessage(data: Partial<Message>) {
    const message = this.create(data);
    return this.save(message);
  }

  async createMessages(data: Partial<Message>[]) {
    const messages = this.create(data);
    return this.save(messages);
  }

  async deleteAllByConversationId(conversationId: string) {
    const result = await this.deleteMany({ conversationId });
    return result.deletedCount ?? 0;
  }

  async countUserMessagesInPeriod(userId: string, hours: number) {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    // Use MongoDB aggregation to join with conversations collection
    const result: { total: number }[] = await this.aggregate<{ total: number }>([
      {
        $match: {
          role: MessageRole.USER,
          createdAt: { $gte: cutoffDate },
        },
      },
      {
        $lookup: {
          from: 'conversations',
          localField: 'conversationId',
          foreignField: 'id',
          as: 'conversation',
        },
      },
      {
        $unwind: '$conversation',
      },
      {
        $match: {
          'conversation.userId': userId,
        },
      },
      {
        $count: 'total',
      },
    ]).toArray();

    return result.length > 0 && result[0] ? result[0].total : 0;
  }

  async countByConversationId(conversationId: string) {
    return this.countBy({ conversationId });
  }

  async countUserMessagesByConversationId(conversationId: string) {
    return this.countBy({ conversationId, role: MessageRole.USER });
  }

  async findMessagesAfterMessageId(conversationId: string, afterMessageId: string) {
    const targetMessage = await this.findOneBy({ id: afterMessageId });

    if (!targetMessage) {
      return this.findBy({ conversationId });
    }

    // Find all messages in this conversation created after the target message
    return this.find({
      where: {
        conversationId,
        createdAt: { $gt: targetMessage.createdAt },
      },
      order: { createdAt: 'ASC' },
    });
  }

  async countUserMessagesAfterMessageId(conversationId: string, afterMessageId: string) {
    const targetMessage = await this.findOneBy({ id: afterMessageId });

    const filter: Parameters<typeof this.countBy>[0] = {
      conversationId,
      role: MessageRole.USER,
    };

    if (targetMessage) {
      filter.createdAt = { $gt: targetMessage.createdAt };
    }

    return this.countBy(filter);
  }
}
