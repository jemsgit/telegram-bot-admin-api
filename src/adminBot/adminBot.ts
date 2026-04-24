import { Telegraf, Context, Composer, Scenes } from "telegraf";
// import { message } from "telegraf/filters";
import {
  getMainAdminMenuScene,
  getAdminUserSearchScene,
  getAdminUserProfileScene,
} from "./scenes";

import type {
  AdminBotConfig,
  AdminBotContext,
  BotApp,
  CustomScene,
  TypedDB,
} from "../types";
// import { mainGlobalMessageHandler } from "./scenes/MainAdminMenuScene";
import { UserService } from "../services/user";
import { BroadcastService } from "../services/broadcast";
import { ReportService } from "../services/report";
import { PromocodeService } from "../services/promocode";
import { SubscriptionService } from "../services/subscriptions";
import { RefferService } from "../services/reffer";
import { PaymentService } from "../services/payment";
import { addScenesToMainBot } from "./scenes/stageFactory";
import { message } from "telegraf/filters";
import { getMainGlobalMessageHandler } from "./scenes/globalMessageHandler";
import { PostContentService } from "../services/postcontent";

type MyContext = Context & Scenes.SceneContext;

export class AdminBot {
  public adminBot: Composer<MyContext>;
  private stage: Scenes.Stage<any>;
  private mainBot: Telegraf<MyContext>;
  private admins: number[];
  private services: {
    userService: UserService;
    broadcastService: BroadcastService;
    reportService: ReportService;
    promocodeService: PromocodeService;
    subscriptionService: SubscriptionService;
    refferService: RefferService;
    paymentService: PaymentService;
    postContentService: PostContentService;
  };
  private customScenes: CustomScene[] = [];

  private config: AdminBotConfig;

  constructor(
    botApp: BotApp,
    config: AdminBotConfig,
    admins: number[],
    db: TypedDB,
    scheduler: any,
    customScenes: CustomScene[]
  ) {
    this.services = {
      userService: new UserService(db),
      broadcastService: new BroadcastService(db, scheduler, botApp),
      reportService: new ReportService(db, botApp),
      promocodeService: new PromocodeService(db),
      subscriptionService: new SubscriptionService(db),
      refferService: new RefferService(db),
      paymentService: new PaymentService(db),
      postContentService: new PostContentService(db),
    };
    this.mainBot = botApp.bot;
    this.config = config;
    this.admins = admins;
    this.customScenes = customScenes;
    this.stage = new Scenes.Stage<AdminBotContext>([]);
    this.adminBot = new Composer<Scenes.SceneContext>();
    this.initHandlers();
  }

  private initStage() {
    this.stage = new Scenes.Stage([
      getMainAdminMenuScene(this.services, this.config, this.customScenes),
      getAdminUserSearchScene(this.services, this.config),
      getAdminUserProfileScene(this.services, this.config),
    ]);

    this.stage.use((ctx, next) => {
      (ctx as any).services = this.services;
      (ctx as any).config = this.config;
      return next();
    });
  }

  private initHandlers() {
    this.adminBot.command("admin", (ctx: Scenes.SceneContext) => {
      ctx.scene?.enter("MainAdminMenuScene");
    });

    this.adminBot.command("user", (ctx) => {
      if (ctx.scene?.current) {
        ctx.scene.leave();
      }
      ctx.reply("👤 Вернулись в пользовательский режим");
      ctx.scene.enter("mainScene"); // если нужно
    });

    const mainGlobalMessageHandler = getMainGlobalMessageHandler(
      this.services,
      this.config,
      this.customScenes
    );

    this.adminBot.on(message("text"), mainGlobalMessageHandler);

    //this.adminBot.use(this.stage.middleware());
  }

  /** Добавляет сцены в основной Stage основного бота */
  attach(mainStage?: Scenes.Stage<Scenes.SceneContext>) {
    if (mainStage) {
      addScenesToMainBot(
        mainStage,
        this.customScenes,
        this.services,
        this.config
      );
      mainStage.use((ctx, next) => {
        console.log("here");
        (ctx as any).services = this.services;
        (ctx as any).config = this.config;
        return next();
      });
    }

    console.log(this.mainBot);
    console.log("this.adminBot.middleware()");
    this.mainBot.use(Composer.acl(this.admins, this.adminBot.middleware()));
  }

  /** Получить Stage для ручной регистрации */
  getStage() {
    return this.stage;
  }
}
