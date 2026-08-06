/**
 * The diplomacy door into the politics command centre.
 *
 * There is no separate diplomacy screen any more. Foreign policy and internal
 * politics are the same subject read from two ends — a realm buys its oil from
 * the neighbour it is about to fight, and the faction that wants the war is the
 * one the tariff made rich — so they live in one screen with two areas.
 *
 * This class exists only to register that screen under the `diplomacy` id and
 * land on the foreign half, so every existing entry point keeps working: the
 * dock, the L shortcut, and every `screens.open('diplomacy', …)` in the game.
 */
import { PoliticsCommandScreen } from './PoliticsScreen';

export class DiplomacyScreen extends PoliticsCommandScreen {
  public readonly id = 'diplomacy' as const;
  protected readonly defaultArea = 'diplomacy' as const;
}
