# Command (Go)

**Categoria:** Behavioral  
**Fonte:** https://refactoring.guru/pt-br/design-patterns/command/go/example

## Intenção

O Command é um padrão de projeto comportamental que converte solicitações ou operações simples em objetos.

A conversão permite a execução adiada ou remota de comandos, armazenamento do histórico de comandos, etc.

## Contexto do Exemplo

Vejamos o padrão Command com o caso de uma TV. Uma TV pode ser LIGADA por:

Podemos começar implementando o objeto de comando LIGAR com a TV como um receptor. Quando o método execute é chamado neste comando, ele, por sua vez, chama a função TV.on . A última parte é definir um invocador. Na verdade, teremos dois invocadores: o controle remoto e a própria TV. Ambos irão incorporar o objeto de comando LIGAR.

Observe como empacotamos a mesma solicitação em vários invocadores. Da mesma forma que podemos fazer com outros comandos. A vantagem de criar um objeto de comando separado é que separamos a lógica da IU da lógica do negócio subjacente. Não há necessidade de desenvolver handlers diferentes para cada um dos invocadores. O objeto de comando contém todas as informações de que precisa para ser executado. Portanto, também pode ser usado para uma execução atrasada.

## Implementação em Go

### `button.go` — Invocador

```go
package main

type Button struct {
	command Command
}

func (b *Button) press() {
	b.command.execute()
}
```

### `command.go` — Interface do command

```go
package main

type Command interface {
	execute()
}
```

### `oncommand.go`

```go
package main

type OnCommand struct {
	device Device
}

func (c *OnCommand) execute() {
	c.device.on()
}
```

### `offcommand.go`

```go
package main

type OffCommand struct {
	device Device
}

func (c *OffCommand) execute() {
	c.device.off()
}
```

### `device.go` — Interface do receptor

```go
package main

type Device interface {
	on()
	off()
}
```

### `tv.go` — Receptor concreto

```go
package main

import "fmt"

type Tv struct {
	isRunning bool
}

func (t *Tv) on() {
	t.isRunning = true
	fmt.Println("Turning tv on")
}

func (t *Tv) off() {
	t.isRunning = false
	fmt.Println("Turning tv off")
}
```

### `main.go` — Código cliente

```go
package main

func main() {
	tv := &Tv{}

	onCommand := &OnCommand{
		device: tv,
	}

	offCommand := &OffCommand{
		device: tv,
	}

	onButton := &Button{
		command: onCommand,
	}
	onButton.press()

	offButton := &Button{
		command: offCommand,
	}
	offButton.press()
}
```
