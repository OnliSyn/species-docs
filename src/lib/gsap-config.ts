'use client';

import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

// Register React plugin
gsap.registerPlugin(useGSAP);

export { gsap, useGSAP };
