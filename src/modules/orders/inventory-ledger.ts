import type {
  InventoryMovement,
  InventoryMovementType
} from "../../domain/catalog/product.js";

export interface InventoryPosition {
  onHand: number;
  reserved: number;
  available: number;
}

function applyMovement(
  position: InventoryPosition,
  type: InventoryMovementType,
  quantity: number
): InventoryPosition {
  switch (type) {
    case "receive":
    case "return":
      return {
        ...position,
        onHand: position.onHand + quantity,
        available: position.onHand + quantity - position.reserved
      };
    case "adjust":
      return {
        ...position,
        onHand: position.onHand + quantity,
        available: position.onHand + quantity - position.reserved
      };
    case "deduct":
      return {
        ...position,
        onHand: position.onHand - quantity,
        available: position.onHand - quantity - position.reserved
      };
    case "reserve":
      return {
        ...position,
        reserved: position.reserved + quantity,
        available: position.onHand - (position.reserved + quantity)
      };
    case "release":
      return {
        ...position,
        reserved: position.reserved - quantity,
        available: position.onHand - (position.reserved - quantity)
      };
  }
}

export function deriveInventoryPosition(
  movements: Pick<InventoryMovement, "type" | "quantity">[]
): InventoryPosition {
  return movements.reduce<InventoryPosition>(
    (position, movement) => applyMovement(position, movement.type, movement.quantity),
    {
      onHand: 0,
      reserved: 0,
      available: 0
    }
  );
}
