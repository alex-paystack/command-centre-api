import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { SavedChartService } from './saved-chart.service';
import { SaveChartDto } from './dto/save-chart.dto';
import { UpdateChartDto } from './dto/update-chart.dto';
import { RegenerateChartQueryDto } from './dto/regenerate-chart-query.dto';
import { SavedChartResponseDto } from './dto/saved-chart-response.dto';
import { SavedChartWithDataResponseDto } from './dto/saved-chart-with-data-response.dto';
import { PaystackResponse } from '~/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('charts')
@ApiBearerAuth()
@Controller('charts')
export class ChartsController {
  constructor(private readonly savedChartService: SavedChartService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Save a new chart configuration',
    description: 'Creates a saved chart that can be retrieved later with fresh data',
  })
  @ApiBody({ type: SaveChartDto })
  @ApiResponse({
    status: 201,
    description: 'Chart saved successfully',
    type: SavedChartResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid chart configuration' })
  async createSavedChart(@Body() dto: SaveChartDto, @CurrentUser() userId: string) {
    const savedChart = await this.savedChartService.saveChart(dto, userId);
    return PaystackResponse.success(savedChart, 'Chart saved successfully');
  }

  @Get()
  @ApiOperation({
    summary: 'Get all saved charts for the authenticated user',
    description: 'Returns all charts saved by the user, sorted by creation date (newest first)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of saved charts',
    type: [SavedChartResponseDto],
  })
  async getAllSavedCharts(@CurrentUser() userId: string) {
    const charts = await this.savedChartService.getAllSavedCharts(userId);
    return PaystackResponse.success(charts, 'Saved charts retrieved successfully');
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a saved chart with fresh data',
    description:
      'Retrieves a saved chart and regenerates its data using the stored configuration. Query parameters can override filter values (from, to, status, currency) for flexible date ranges and filtering. The resourceType and aggregationType remain immutable.',
  })
  @ApiParam({ name: 'id', description: 'Saved chart UUID', type: String })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Override the start date (ISO format, e.g., 2024-01-01)',
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'Override the end date (ISO format, e.g., 2024-01-31)',
    example: '2024-01-31',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Override the status filter (e.g., success, failed, abandoned)',
    example: 'success',
  })
  @ApiQuery({
    name: 'currency',
    required: false,
    description: 'Override the currency filter (e.g., NGN, USD, GHS)',
    example: 'NGN',
  })
  @ApiResponse({
    status: 200,
    description: 'Saved chart with regenerated data',
    type: SavedChartWithDataResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Saved chart not found' })
  @ApiResponse({ status: 400, description: 'Failed to generate chart data or invalid filter values' })
  async getSavedChartWithData(
    @Param('id') chartId: string,
    @Query() queryDto: RegenerateChartQueryDto,
    @CurrentUser() userId: string,
    @Req() req: Request,
  ) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization header missing or malformed');
    }

    const jwtToken = authHeader.split(' ')[1];
    const savedChart = await this.savedChartService.getSavedChartWithData(chartId, userId, jwtToken, queryDto);
    return PaystackResponse.success(savedChart, 'Chart data retrieved successfully');
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update saved chart metadata',
    description: 'Updates the name and/or description of a saved chart. Chart configuration cannot be modified.',
  })
  @ApiParam({ name: 'id', description: 'Saved chart UUID', type: String })
  @ApiBody({ type: UpdateChartDto })
  @ApiResponse({
    status: 200,
    description: 'Chart updated successfully',
    type: SavedChartResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - no fields provided' })
  @ApiResponse({ status: 404, description: 'Saved chart not found' })
  async updateSavedChart(@Param('id') chartId: string, @Body() dto: UpdateChartDto, @CurrentUser() userId: string) {
    const updatedChart = await this.savedChartService.updateSavedChart(chartId, userId, dto);
    return PaystackResponse.success(updatedChart, 'Chart updated successfully');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a saved chart',
    description: 'Permanently deletes a saved chart. This action cannot be undone.',
  })
  @ApiParam({ name: 'id', description: 'Saved chart UUID', type: String })
  @ApiResponse({ status: 200, description: 'Chart deleted successfully' })
  @ApiResponse({ status: 404, description: 'Saved chart not found' })
  async deleteSavedChart(@Param('id') chartId: string, @CurrentUser() userId: string) {
    await this.savedChartService.deleteSavedChart(chartId, userId);
    return PaystackResponse.success(null, 'Chart deleted successfully');
  }
}
