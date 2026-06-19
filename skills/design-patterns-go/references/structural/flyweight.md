# Flyweight (Go)

**Categoria:** Structural  
**Fonte:** https://refactoring.guru/pt-br/design-patterns/flyweight/go/example

## Intenção

O O Flyweight é um padrão de projeto estrutural que permite que os programas suportem grandes quantidades de objetos, mantendo baixo o consumo de memória.

O padrão consegue isso compartilhando partes do estado do objeto entre vários objetos. Em outras palavras, o Flyweight economiza RAM armazenando em cache os mesmos dados usados por objetos diferentes.

## Contexto do Exemplo

Em um jogo de Counter-Strike, os Terroristas e Antiterroristas têm um tipo de uniforme diferente. Para simplificar, vamos supor que tanto os Terroristas quanto os Antiterroristas tenham um tipo de uniforme cada. O objeto uniforme (dress) é embutido no objeto jogador (player) como abaixo.

Abaixo está a struct de um player. Podemos ver que o objeto dress está incorporado na struct do player:

Digamos que haja 5 Terroristas e 5 Antiterroristas, então um total de 10 players. Agora, existem duas opções de dress.

## Implementação em Go

### `dressfactory.go`

```go
package main

import "fmt"

const (
	//TerroristDressType terrorist dress type
	TerroristDressType = "tDress"
	//CounterTerrroristDressType terrorist dress type
	CounterTerrroristDressType = "ctDress"
)

var (
	dressFactorySingleInstance = &DressFactory{
		dressMap: make(map[string]Dress),
	}
)

type DressFactory struct {
	dressMap map[string]Dress
}

func (d *DressFactory) getDressByType(dressType string) (Dress, error) {
	if d.dressMap[dressType] != nil {
		return d.dressMap[dressType], nil
	}

	if dressType == TerroristDressType {
		d.dressMap[dressType] = newTerroristDress()
		return d.dressMap[dressType], nil
	}
	if dressType == CounterTerrroristDressType {
		d.dressMap[dressType] = newCounterTerroristDress()
		return d.dressMap[dressType], nil
	}

	return nil, fmt.Errorf("Wrong dress type passed")
}

func getDressFactorySingleInstance() *DressFactory {
	return dressFactorySingleInstance
}
```

### `dress.go` — Interface do flyweight

```go
package main

type Dress interface {
	getColor() string
}
```

### `terroristdress.go`

```go
package main

type TerroristDress struct {
	color string
}

func (t *TerroristDress) getColor() string {
	return t.color
}

func newTerroristDress() *TerroristDress {
	return &TerroristDress{color: "red"}
}
```

### `counterterroristdress.go`

```go
package main

type CounterTerroristDress struct {
	color string
}

func (c *CounterTerroristDress) getColor() string {
	return c.color
}

func newCounterTerroristDress() *CounterTerroristDress {
	return &CounterTerroristDress{color: "green"}
}
```

### `player.go` — Contexto

```go
package main

type Player struct {
	dress      Dress
	playerType string
	lat        int
	long       int
}

func newPlayer(playerType, dressType string) *Player {
	dress, _ := getDressFactorySingleInstance().getDressByType(dressType)
	return &Player{
		playerType: playerType,
		dress:      dress,
	}
}

func (p *Player) newLocation(lat, long int) {
	p.lat = lat
	p.long = long
}
```

### `game.go` — Código cliente

```go
package main

type game struct {
	terrorists        []*Player
	counterTerrorists []*Player
}

func newGame() *game {
	return &game{
		terrorists:        make([]*Player, 1),
		counterTerrorists: make([]*Player, 1),
	}
}

func (c *game) addTerrorist(dressType string) {
	player := newPlayer("T", dressType)
	c.terrorists = append(c.terrorists, player)
	return
}

func (c *game) addCounterTerrorist(dressType string) {
	player := newPlayer("CT", dressType)
	c.counterTerrorists = append(c.counterTerrorists, player)
	return
}
```

### `main.go` — Código cliente

```go
package main

import "fmt"

func main() {
	game := newGame()

	//Add Terrorist
	game.addTerrorist(TerroristDressType)
	game.addTerrorist(TerroristDressType)
	game.addTerrorist(TerroristDressType)
	game.addTerrorist(TerroristDressType)

	//Add CounterTerrorist
	game.addCounterTerrorist(CounterTerrroristDressType)
	game.addCounterTerrorist(CounterTerrroristDressType)
	game.addCounterTerrorist(CounterTerrroristDressType)

	dressFactoryInstance := getDressFactorySingleInstance()

	for dressType, dress := range dressFactoryInstance.dressMap {
		fmt.Printf("DressColorType: %s\nDressColor: %s\n", dressType, dress.getColor())
	}
}
```
