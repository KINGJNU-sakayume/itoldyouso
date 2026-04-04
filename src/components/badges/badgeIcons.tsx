import {
  Compass, Wind, Anchor, Map, Moon, Zap, Rocket, TrendingUp,
  Flame, Radio, Eye, Star, Shield, Waves, Sparkles,
  Crown, Heart, Mic2, Users, Award, Globe, Music4,
  Sunrise, Calendar, BadgeCheck, Flag, Target,
  Trophy, Layers, Gem, Medal, Diamond, Coffee,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

const iconMap: Record<string, React.FC<LucideProps>> = {
  Compass,
  Wind,
  Anchor,
  Map,
  Moon,
  Zap,
  Rocket,
  TrendingUp,
  Flame,
  Radio,
  Eye,
  Star,
  Shield,
  Waves,
  Sparkles,
  Crown,
  Heart,
  Mic2,
  Users,
  Award,
  Globe,
  Music4,
  Sunrise,
  Calendar,
  Badge: BadgeCheck,
  Flag,
  Target,
  Trophy,
  Layers,
  Gem,
  Medal,
  Diamond,
  Coffee,
};

export function getBadgeIcon(iconName: string): React.FC<LucideProps> {
  return iconMap[iconName] || Star;
}
