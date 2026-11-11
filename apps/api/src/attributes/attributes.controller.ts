import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SessionGuard } from '../auth/guards/session/session.guard';
import { WriteOriginGuard } from '../auth/guards/write-origin.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation/zod-validation.pipe';
import {
  attributeQuerySchema,
  createAttributeSchema,
  updateAttributeSchema,
} from './attribute.schema';
import type {
  AttributeQuery,
  CreateAttributeInput,
  UpdateAttributeInput,
} from './attribute.schema';
import { AttributesService } from './attributes.service';

@Controller('attributes')
export class AttributesController {
  constructor(private readonly attributes: AttributesService) {}

  @Get()
  findAll(
    @Query(new ZodValidationPipe(attributeQuerySchema)) query: AttributeQuery,
  ) {
    return this.attributes.findAll(query);
  }
}

@Controller('admin/attributes')
@UseGuards(SessionGuard, AdminGuard, WriteOriginGuard)
export class AdminAttributesController {
  constructor(private readonly attributes: AttributesService) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createAttributeSchema))
    input: CreateAttributeInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const attribute = await this.attributes.create(input);
    response.location(`/admin/attributes/${attribute.id}`);
    return attribute;
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateAttributeSchema))
    input: UpdateAttributeInput,
  ) {
    return this.attributes.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.attributes.delete(id);
  }
}
