import {
  BadRequestException,
  Body,
  Controller,
  Post,
} from '@nestjs/common';
import { ScenarioSimulationService } from './scenario-simulation.service';
import { StressTestService } from './stress-test.service';
import { StrategyScenarioService } from './strategy-scenario.service';
import { SimulateScenarioDto } from './dto/simulate-scenario.dto';
import { StressTestDto } from './dto/stress-test.dto';

@Controller('scenario')
export class ScenarioController {
  constructor(
    private readonly simulation: ScenarioSimulationService,
    private readonly stress: StressTestService,
    private readonly strategyScenario: StrategyScenarioService,
  ) {}

  @Post('simulate')
  async simulate(@Body() dto: SimulateScenarioDto) {
    const n = dto.carIds.length;
    let weights = dto.weights ?? dto.carIds.map(() => 1 / n);
    if (weights.length !== dto.carIds.length) {
      throw new BadRequestException('طول weights با carIds برابر نیست');
    }
    const s = weights.reduce((a, b) => a + b, 0);
    if (Math.abs(s - 1) > 1e-3) weights = weights.map((w) => w / s);

    return this.simulation.runScenario(
      { carIds: dto.carIds, weights },
      dto.scenarioId,
      { paths: dto.paths },
    );
  }

  @Post('stress-test')
  async stressTest(@Body() dto: StressTestDto) {
    const n = dto.carIds.length;
    let weights = dto.weights ?? dto.carIds.map(() => 1 / n);
    if (weights.length !== dto.carIds.length) {
      throw new BadRequestException('طول weights با carIds برابر نیست');
    }
    const s = weights.reduce((a, b) => a + b, 0);
    if (Math.abs(s - 1) > 1e-3) weights = weights.map((w) => w / s);

    const portfolio = { carIds: dto.carIds, weights };
    if (dto.scenarioIds?.length) {
      const results = [];
      for (const sid of dto.scenarioIds) {
        results.push(
          await this.stress.runStressTest(portfolio, sid, {
            paths: dto.paths,
            persist: dto.persist !== false,
          }),
        );
      }
      return { portfolio, results };
    }
    return this.stress.runStandardBattery(portfolio, {
      paths: dto.paths,
      persist: dto.persist !== false,
    });
  }

  /** بازمحاسبهٔ ماتریس استراتژی × سناریو (سنگین) */
  @Post('recompute-strategy-performance')
  recomputeStrategies() {
    return this.strategyScenario.recomputeAllStrategyScenarioRows();
  }
}
