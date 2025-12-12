import { Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";

export interface EmailJobData {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Processor("email")
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  @Process("send-email")
  async handleSendEmail(job: Job<EmailJobData>) {
    this.logger.log("Processing email job", job.data);

    try {
      // Simulate email sending
      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.logger.log(
        `Email sent to ${job.data.to} with subject: ${job.data.subject}`,
      );

      return {
        success: true,
        sentAt: new Date(),
      };
    } catch (error) {
      this.logger.error("Failed to send email", error);
      throw error;
    }
  }
}
