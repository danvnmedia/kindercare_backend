import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class FileResponse {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  key: string;

  @ApiProperty()
  @Expose()
  filename: string;

  @ApiProperty()
  @Expose()
  mimeType: string;

  @ApiProperty({ type: 'string', format: 'int64' })
  @Expose()
  size: bigint;

  @ApiProperty()
  @Expose()
  status: string;

  @ApiProperty()
  @Expose()
  uploadedBy: string;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;
}
