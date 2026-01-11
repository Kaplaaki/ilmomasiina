import { DataTypes, Model, Op, Optional, Sequelize } from "sequelize";

import { PaymentStatus, ProductSchema } from "@tietokilta/ilmomasiina-models";
import { jsonColumnGetter } from "./util/json";

export interface PaymentAttributes {
  id: number;
  signupId: string;
  stripeCheckoutSessionId: string | null;
  status: PaymentStatus;
  amount: number;
  currency: string;
  products: ProductSchema[];
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  completedAt: Date | null;
}

// TODO: This is a bit unconsistent with other models, since others don't define createdAt at all in
//  the FooAttributes interface. It still shouldn't be passed to Model<> since we want the Sequelize
//  defaults for it.
interface PaymentManualAttributes extends Omit<PaymentAttributes, "createdAt" | "updatedAt"> {}

export interface PaymentCreateAttributes extends Optional<
  PaymentManualAttributes,
  "id" | "stripeCheckoutSessionId" | "status" | "completedAt"
> {}

export class Payment extends Model<PaymentManualAttributes, PaymentCreateAttributes> implements PaymentAttributes {
  public id!: number;
  public signupId!: string;
  public stripeCheckoutSessionId!: string;
  public status!: PaymentStatus;
  public amount!: number;
  public currency!: string;
  public products!: ProductSchema[];

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly expiresAt!: Date;
  public completedAt!: Date | null;
}

export default function setupPaymentModel(sequelize: Sequelize) {
  Payment.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true,
      },
      signupId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      stripeCheckoutSessionId: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM(...Object.values(PaymentStatus)),
        allowNull: false,
        defaultValue: PaymentStatus.CREATING,
      },
      amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      currency: {
        type: DataTypes.CHAR(8),
        allowNull: false,
      },
      products: {
        type: DataTypes.JSON,
        allowNull: false,
        get: jsonColumnGetter<string | string[]>("products"),
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "payment",
      freezeTableName: true,
      scopes: {
        active: {
          where: {
            status: { [Op.in]: [PaymentStatus.CREATING, PaymentStatus.PENDING, PaymentStatus.PAID] },
          },
        },
      },
    },
  );
}
