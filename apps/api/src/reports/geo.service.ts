import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface GeoPoint {
  id: string;
  submissionId: string;
  assignmentId: string;
  componentId: string;
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  captureMethod: 'gps' | 'map_selection';
  capturedAt: string;
  nodeId: string;
  nodeCode: string;
}

@Injectable()
export class GeoService {
  constructor(private readonly prisma: DatabaseService) {}

  /**
   * Returns all geo points for submissions in a campaign.
   * Optionally filtered by a bounding box "minLng,minLat,maxLng,maxLat".
   *
   * Uses raw SQL because PostGIS geometry columns are Unsupported in Prisma.
   * ST_X / ST_Y extract longitude / latitude from Point(lng, lat) in EPSG:4326.
   */
  async getGeoPoints(campaignId: string, bbox?: string): Promise<GeoPoint[]> {
    const bboxClause = this.parseBbox(bbox);

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        submission_id: string;
        assignment_id: string;
        component_id: string;
        lat: number;
        lng: number;
        accuracy_meters: string | null;
        capture_method: string;
        captured_at: Date;
        node_id: string;
        node_code: string;
      }>
    >(
      `
      SELECT
        gp.id,
        gp.submission_id,
        sa.id              AS assignment_id,
        gp.component_id,
        ST_Y(gp.location)  AS lat,
        ST_X(gp.location)  AS lng,
        gp.accuracy_meters,
        gp.capture_method,
        gp.captured_at,
        xn.id              AS node_id,
        xn.code            AS node_code
      FROM submission_geo_points gp
      JOIN submissions s         ON s.id = gp.submission_id
      JOIN submissions_assignments sa ON sa.id = s.assignment_id
      JOIN xedu_nodes xn         ON xn.id = sa.assigned_node_id
      WHERE sa.campaign_id = $1::uuid
        ${bboxClause ? `AND ST_Within(gp.location, ST_MakeEnvelope($2, $3, $4, $5, 4326))` : ''}
      ORDER BY gp.captured_at DESC
      LIMIT 2000
      `,
      ...(bboxClause
        ? [campaignId, bboxClause.minLng, bboxClause.minLat, bboxClause.maxLng, bboxClause.maxLat]
        : [campaignId]),
    );

    return rows.map((r) => ({
      id: r.id,
      submissionId: r.submission_id,
      assignmentId: r.assignment_id,
      componentId: r.component_id,
      lat: Number(r.lat),
      lng: Number(r.lng),
      accuracyMeters: r.accuracy_meters ? Number(r.accuracy_meters) : null,
      captureMethod: r.capture_method as 'gps' | 'map_selection',
      capturedAt: r.captured_at.toISOString(),
      nodeId: r.node_id,
      nodeCode: r.node_code,
    }));
  }

  private parseBbox(
    bbox?: string,
  ): { minLng: number; minLat: number; maxLng: number; maxLat: number } | null {
    if (!bbox) return null;
    const parts = bbox.split(',').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return null;
    const [minLng, minLat, maxLng, maxLat] = parts;
    return { minLng, minLat, maxLng, maxLat };
  }
}
