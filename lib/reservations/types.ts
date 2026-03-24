export type ReservationStatus = "pending" | "confirmed" | "seated" | "completed" | "canceled" | "no_show";

export type ReservationRecord = {
  id: string;
  restaurant_id?: string;
  start_at: string;
  end_at: string;
  party_size: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  notes: string | null;
  status: ReservationStatus;
  created_by: "dashboard" | "chatbot" | "widget" | "phone";
  canceled_at: string | null;
  seated_at: string | null;
  completed_at: string | null;
  no_show_at: string | null;
  lane_index: number;
  datetime?: string | null;
};

export type ReservationSettingsResponse = {
  restaurantId: string;
  totalCapacity: number;
  timezone: string;
  settings: {
    slot_interval_min: number;
    default_duration_min: number;
    lead_time_min: number;
    max_days_ahead: number;
    buffer_before_min: number;
    buffer_after_min: number;
    auto_archive_after_hours: number;
    lane_count: number;
  };
};

export type ReservationListResponse = {
  reservations: ReservationRecord[];
  laneCount: number;
  overflowLaneIndex: number;
  intervalMin: number;
  totalCapacity: number;
  timezone: string;
};
