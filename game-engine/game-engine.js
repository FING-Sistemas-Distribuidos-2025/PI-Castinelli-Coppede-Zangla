class GameEngine {
    constructor() {
        this.entities = [];
        this.systems = [];
    }

    addEntity(entity) {
        this.entities.push(entity);
    }

    addSystem(system) {
        this.systems.push(system);
    }

    update(deltaTime) {
        for (const system of this.systems) {
            system.update(this.entities, deltaTime);
        }
    }
}