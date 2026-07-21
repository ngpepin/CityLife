'use client';

import React from 'react';
import { GameProvider } from '@/context/GameContext';
import { CityLifeMode } from '@/components/citylife/CityLifeMode';

export default function CityLifePage() {
  return (
    <GameProvider startFresh disablePersistence gameMode="citylife">
      <CityLifeMode />
    </GameProvider>
  );
}
