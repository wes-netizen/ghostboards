export type Build = {
  deckShapeId?: string;
  deckThicknessId?: '3_4' | '1';
  deckFinish?: 'clear' | 'color';
  fullLedDeck?: boolean;
  trucksId?: string;
  wheelsId?: string;
  bumperIds?: string[];
  careIds?: string[];
  tToolIds?: string[];
  rackId?: string;
  deckColor: string;
  ledColor: string;
  ledIntensity: number;
  uploadFile?: File | null;
};